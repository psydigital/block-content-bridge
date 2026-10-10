<?php
namespace PsyDigital\BlockContentBridge;

final class Renderer {
    public static function register(): void {
        register_rest_route( 'psy-block-bridge/v1', '/render', [
            'methods' => 'POST',
            'callback' => [ self::class, 'render' ],
            'permission_callback' => [ self::class, 'permission' ],
            'args' => [
                'post_id' => [ 'type' => 'integer', 'required' => true, 'minimum' => 1 ],
                'content' => [ 'type' => 'string', 'required' => true ],
                'title' => [ 'type' => 'string', 'default' => '' ],
            ],
        ] );
    }

    public static function permission( \WP_REST_Request $request ) {
        $post = get_post( $request['post_id'] );
        if ( ! $post || ! current_user_can( 'edit_post', $post->ID ) ) {
            return new \WP_Error( 'psy_bcb_forbidden', __( 'You cannot analyse this post.', 'block-content-bridge' ), [ 'status' => rest_authorization_required_code() ] );
        }
        if ( ! in_array( $post->post_type, Settings::get()['post_types'], true ) ) {
            return new \WP_Error( 'psy_bcb_disabled', __( 'Analysis is disabled for this post type.', 'block-content-bridge' ), [ 'status' => 403 ] );
        }
        return true;
    }

    public static function render( \WP_REST_Request $request ) {
        if ( strlen( $request['content'] ) > 1048576 ) {
            return new \WP_Error( 'psy_bcb_size', __( 'This document exceeds the 1 MB analysis limit.', 'block-content-bridge' ), [ 'status' => 413 ] );
        }
        $options = Settings::get();
        $blocks = 0;
        $excluded = 0;
        $filter = static function ( $pre_render, $block ) use ( $options, &$blocks, &$excluded ) {
            if ( empty( $block['blockName'] ) ) return $pre_render;
            ++$blocks;
            if ( $blocks > 1000 ) throw new \RuntimeException( 'Block limit reached.' );
            if ( in_array( $block['blockName'], $options['excluded_blocks'], true ) ) {
                ++$excluded;
                return '';
            }
            return $pre_render;
        };
        $global_names = [ 'post', 'id', 'authordata', 'currentday', 'currentmonth', 'page', 'pages', 'multipage', 'more', 'numpages' ];
        $previous = [];
        foreach ( $global_names as $name ) $previous[$name] = [ array_key_exists( $name, $GLOBALS ), $GLOBALS[$name] ?? null ];
        $post = clone get_post( $request['post_id'] );
        $post->post_content = $request['content'];
        $post->post_title = sanitize_text_field( $request['title'] );
        $GLOBALS['post'] = $post;
        setup_postdata( $post );
        add_filter( 'pre_render_block', $filter, 10, 2 );
        $buffer_level = ob_get_level();
        ob_start();
        try {
            $html = do_shortcode( do_blocks( $request['content'] ) );
            if ( strlen( $html ) > 5242880 ) throw new \RuntimeException( 'Output limit reached.' );
            $response = new \WP_REST_Response( [ 'html' => $html, 'blocks' => $blocks, 'excluded' => $excluded ] );
            $response->header( 'Cache-Control', 'no-store, private' );
            return $response;
        } catch ( \Throwable $error ) {
            return new \WP_Error( 'psy_bcb_render', __( 'A block could not be rendered, or this document exceeds the analysis limits. Check its preview and try again.', 'block-content-bridge' ), [ 'status' => 500 ] );
        } finally {
            while ( ob_get_level() > $buffer_level ) ob_end_clean();
            remove_filter( 'pre_render_block', $filter, 10 );
            foreach ( $previous as $name => [ $exists, $value ] ) {
                if ( $exists ) $GLOBALS[$name] = $value;
                else unset( $GLOBALS[$name] );
            }
        }
    }
}
