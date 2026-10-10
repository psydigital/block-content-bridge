<?php
/** Run with: wp eval-file tests/wp-integration.php --path=/path/to/disposable/wordpress */

if ( ! defined( 'PSY_BCB_TEST_SITE' ) || PSY_BCB_TEST_SITE !== true ) {
    WP_CLI::error( 'This suite requires PSY_BCB_TEST_SITE=true on a disposable test site.' );
}

$failures = [];
$checks   = 0;
$check = static function ( $condition, $message ) use ( &$failures, &$checks ) {
    ++$checks;
    if ( ! $condition ) {
        $failures[] = $message;
        WP_CLI::warning( $message );
    }
};

$administrator = get_users( [ 'role' => 'administrator', 'number' => 1 ] )[0];
$reader = wp_insert_user( [
    'user_login' => 'bridge-reader-' . wp_generate_password( 8, false ),
    'user_pass'  => wp_generate_password(),
    'role'       => 'subscriber',
] );
$author = wp_insert_user( [
    'user_login' => 'bridge-author-' . wp_generate_password( 8, false ),
    'user_pass'  => wp_generate_password(),
    'role'       => 'author',
] );
$post_id = wp_insert_post( [
    'post_title'   => 'Saved title',
    'post_content' => '<p>Saved content</p>',
    'post_status'  => 'draft',
    'post_author'  => $administrator->ID,
] );
$previous_options = get_option( 'psy_bcb_options', null );
delete_option( 'psy_bcb_options' );

register_block_type( 'sample/card', [
    'api_version'     => 3,
    'attributes'      => [ 'text' => [ 'type' => 'string', 'default' => '' ] ],
    'render_callback' => static function ( $attributes ) {
        return '<h2>' . esc_html( $attributes['text'] ) . '</h2><a href="https://example.org">Example</a><img src="https://example.org/photo.jpg" alt="Sample photo">';
    },
] );
register_block_type( 'sample/broken', [
    'render_callback' => static function () { throw new RuntimeException( 'Private internal error detail' ); },
] );
$other_post_id = wp_insert_post( [ 'post_title' => 'Unrelated post', 'post_status' => 'draft' ] );
register_block_type( 'sample/reset-context', [
    'render_callback' => static function () use ( $other_post_id ) {
        $GLOBALS['post'] = get_post( $other_post_id );
        setup_postdata( $GLOBALS['post'] );
        wp_reset_postdata();
        return '';
    },
] );
register_block_type( 'sample/current-title', [
    'render_callback' => static function () { return '<p>' . esc_html( get_the_title() ) . '</p>'; },
] );

$request = static function ( $content, $id = null ) use ( $post_id ) {
    $request = new WP_REST_Request( 'POST', '/psy-block-bridge/v1/render' );
    $request->set_body_params( [ 'post_id' => $id ?? $post_id, 'content' => $content, 'title' => 'Unsaved title' ] );
    return rest_do_request( $request );
};

try {
    wp_set_current_user( 0 );
    $check( $request( '' )->get_status() === 401, 'Anonymous requests cannot render post content.' );
    wp_set_current_user( $reader );
    $check( $request( '' )->get_status() === 403, 'Subscribers cannot render editorial content.' );
    wp_set_current_user( $author );
    $check( $request( '' )->get_status() === 403, 'Authors cannot render another author\'s private draft.' );
    wp_set_current_user( $administrator->ID );
    $content = '<!-- wp:paragraph --><p>Before</p><!-- /wp:paragraph --><!-- wp:group --><div class="wp-block-group"><!-- wp:sample/card {"text":"Unsaved block"} /--></div><!-- /wp:group --><!-- wp:paragraph --><p>After</p><!-- /wp:paragraph -->';
    $response = $request( $content );
    $data = $response->get_data();
    $check( $response->get_status() === 200, 'Editors can render the current block document.' );
    $html = $data['html'] ?? '';
    $check( str_contains( $html, '<h2>Unsaved block</h2>' ), 'Custom namespace dynamic blocks render unsaved attributes.' );
    $check( substr_count( $html, 'Unsaved block' ) === 1, 'Nested block text appears once.' );
    $check( strpos( $html, 'Before' ) < strpos( $html, 'Unsaved block' ) && strpos( $html, 'Unsaved block' ) < strpos( $html, 'After' ), 'Native and dynamic content retain document order.' );
    $check( str_contains( $html, 'alt="Sample photo"' ) && str_contains( $html, 'href="https://example.org"' ), 'Rendered HTML keeps links and image metadata.' );
    $check( get_post( $post_id )->post_content === '<p>Saved content</p>' && get_post( $post_id )->post_title === 'Saved title', 'Analysis does not save edited content or title.' );
    $context = $request( '<!-- wp:sample/reset-context /--><!-- wp:sample/current-title /-->' )->get_data();
    $check( ( $context['html'] ?? '' ) === '<p>Unsaved title</p>', 'Query blocks can reset post data without changing the draft used by following blocks.' );

    update_option( 'psy_bcb_options', [ 'post_types' => [ 'post' ], 'excluded_blocks' => [ 'sample/card' ], 'refresh' => 'auto', 'selectors' => [] ] );
    $data = $request( $content )->get_data();
    $check( ! str_contains( $data['html'] ?? '', 'Unsaved block' ) && ( $data['excluded'] ?? 0 ) === 1, 'Excluding a block removes its rendered content.' );
    update_option( 'psy_bcb_options', [ 'post_types' => [], 'excluded_blocks' => [], 'refresh' => 'auto', 'selectors' => [] ] );
    $check( $request( $content )->get_status() === 403, 'Disabling all post types also disables the render endpoint.' );
    delete_option( 'psy_bcb_options' );
    $check( $request( str_repeat( 'x', 1048577 ) )->get_status() === 413, 'Oversized requests are rejected before rendering.' );
    $check( $request( '<!-- wp:sample/broken /-->' )->get_status() === 500, 'Template failures are reported without a successful partial analysis.' );
    $check( ! str_contains( wp_json_encode( $request( '<!-- wp:sample/broken /-->' )->get_data() ), 'Private internal error' ), 'Template exception details are not disclosed.' );
    $check( ( $request( '' )->get_data()['html'] ?? null ) === '', 'An empty document produces empty HTML.' );
    $check( ! has_filter( 'pre_render_block', [ 'PsyDigital\\BlockContentBridge\\Renderer', 'exclude' ] ), 'Rendering leaves no exclusion filter attached.' );
} finally {
    if ( $previous_options === null ) delete_option( 'psy_bcb_options' );
    else update_option( 'psy_bcb_options', $previous_options );
    wp_delete_post( $post_id, true );
    wp_delete_post( $other_post_id, true );
    require_once ABSPATH . 'wp-admin/includes/user.php';
    wp_delete_user( $reader );
    wp_delete_user( $author );
}

if ( $failures ) WP_CLI::error( count( $failures ) . ' of ' . $checks . ' integration checks failed.' );
WP_CLI::success( $checks . ' integration checks passed.' );
