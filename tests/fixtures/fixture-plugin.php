<?php
/** Plugin Name: Block Bridge Test Fixtures */
add_action( 'init', static function () {
    if ( ! function_exists( 'acf_add_local_field_group' ) ) return;
    register_block_type( __DIR__ . '/acf-card' );
    acf_add_local_field_group( [
        'key' => 'group_bcb_fixture',
        'title' => 'Bridge fixture',
        'fields' => [ [ 'key' => 'field_bcb_copy', 'label' => 'Copy', 'name' => 'copy', 'type' => 'textarea' ] ],
        'location' => [ [ [ 'param' => 'block', 'operator' => '==', 'value' => 'studio/card' ] ] ],
    ] );
    acf_add_local_field_group( [
        'key' => 'group_bcb_meta_fixture',
        'title' => 'Separate editorial fields',
        'fields' => [ [ 'key' => 'field_bcb_meta_copy', 'label' => 'Additional copy', 'name' => 'additional_copy', 'type' => 'text' ] ],
        'location' => [ [ [ 'param' => 'post_type', 'operator' => '==', 'value' => 'post' ] ], [ [ 'param' => 'taxonomy', 'operator' => '==', 'value' => 'category' ] ] ],
    ] );
}, 20 );
