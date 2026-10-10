<?php
namespace PsyDigital\BlockContentBridge;

final class Plugin {
    public static function boot(): void {
        add_action( 'rest_api_init', [ Renderer::class, 'register' ] );
        add_action( 'admin_init', [ Settings::class, 'register' ] );
        add_action( 'admin_menu', [ Settings::class, 'menu' ] );
        add_action( 'enqueue_block_editor_assets', [ self::class, 'enqueue' ] );
    }

    public static function conflict(): string {
        if ( ! defined( 'WPSEO_VERSION' ) || version_compare( WPSEO_VERSION, '24.6', '<' ) ) {
            return __( 'Block Content Bridge needs Yoast SEO 24.6 or newer to supply analysis.', 'block-content-bridge' );
        }
        if ( defined( 'AC_SEO_ACF_ANALYSIS_PLUGIN_FILE' ) ) {
            return __( 'Analysis is paused because ACF Content Analysis for Yoast SEO is active. Choose one content collector to prevent duplicate or overwritten analysis. This bridge analyses rendered post blocks; it does not collect separate custom-field metaboxes.', 'block-content-bridge' );
        }
        return '';
    }

    public static function enqueue(): void {
        $screen = get_current_screen();
        $post = get_post();
        $options = Settings::get();
        if ( ! $screen || $screen->base !== 'post' || ! $post || ! current_user_can( 'edit_post', $post->ID ) || ! in_array( $post->post_type, $options['post_types'], true ) ) return;
        wp_enqueue_script( 'psy-bcb-analysis', plugins_url( 'assets/analysis.js', FILE ), [], VERSION, true );
        wp_enqueue_script( 'psy-bcb-editor', plugins_url( 'assets/editor.js', FILE ), [ 'psy-bcb-analysis', 'wp-api-fetch', 'wp-data', 'wp-element', 'wp-components', 'wp-plugins', 'wp-editor', 'wp-dom-ready', 'wp-i18n' ], VERSION, true );
        wp_add_inline_script( 'psy-bcb-editor', 'window.psyBlockBridgeSettings = ' . wp_json_encode( [
            'refresh' => $options['refresh'],
            'selectors' => $options['selectors'],
            'conflict' => self::conflict(),
        ] ) . ';', 'before' );
    }
}
