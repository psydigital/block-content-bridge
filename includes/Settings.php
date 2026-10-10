<?php
namespace PsyDigital\BlockContentBridge;

final class Settings {
    const OPTION = 'psy_bcb_options';

    public static function post_types(): array {
        return array_filter( get_post_types( [ 'show_ui' => true ], 'objects' ), static function ( $type ) {
            return $type->show_in_rest && post_type_supports( $type->name, 'editor' ) && $type->name !== 'attachment';
        } );
    }

    public static function defaults(): array {
        $public = array_filter( self::post_types(), static function ( $type ) { return $type->public; } );
        return [ 'post_types' => array_keys( $public ), 'excluded_blocks' => [], 'refresh' => 'auto', 'selectors' => [] ];
    }

    public static function get(): array {
        return self::sanitize( get_option( self::OPTION, self::defaults() ) );
    }

    public static function sanitize( $input ): array {
        $input = is_array( $input ) ? $input : [];
        $types = array_keys( self::post_types() );
        $selected = isset( $input['post_types'] ) && is_array( $input['post_types'] ) ? $input['post_types'] : [];
        $blocks = isset( $input['excluded_blocks'] ) && is_array( $input['excluded_blocks'] ) ? $input['excluded_blocks'] : [];
        $selectors = $input['selectors'] ?? [];
        if ( is_string( $selectors ) ) $selectors = preg_split( '/\r\n|\r|\n/', $selectors );
        $selectors = is_array( $selectors ) ? $selectors : [];
        return [
            'post_types' => array_values( array_intersect( $types, array_filter( $selected, 'is_string' ) ) ),
            'excluded_blocks' => array_values( array_unique( array_filter( $blocks, static function ( $name ) {
                return is_string( $name ) && preg_match( '/^[a-z0-9-]+\/[a-z0-9-]+$/D', $name );
            } ) ) ),
            'refresh' => ( $input['refresh'] ?? '' ) === 'manual' ? 'manual' : 'auto',
            'selectors' => array_values( array_filter( array_map( static function ( $selector ) {
                return is_string( $selector ) ? trim( sanitize_text_field( $selector ) ) : '';
            }, array_slice( $selectors, 0, 30 ) ) ) ),
        ];
    }

    public static function register(): void {
        register_setting( 'psy_bcb', self::OPTION, [ 'type' => 'array', 'sanitize_callback' => [ self::class, 'sanitize' ], 'default' => self::defaults() ] );
    }

    public static function menu(): void {
        add_options_page( 'Block Content Bridge', 'Block Content Bridge', 'manage_options', 'block-content-bridge', [ self::class, 'page' ] );
    }

    public static function page(): void {
        if ( ! current_user_can( 'manage_options' ) ) return;
        $options = self::get();
        ?>
        <div class="wrap">
            <h1><?php esc_html_e( 'Block Content Bridge', 'block-content-bridge' ); ?></h1>
            <p><?php esc_html_e( 'Choose which editor content is supplied to Yoast. Analysis does not save or publish your changes.', 'block-content-bridge' ); ?></p>
            <?php if ( Plugin::conflict() ) : ?>
                <div class="notice notice-warning inline"><p><?php echo esc_html( Plugin::conflict() ); ?></p></div>
            <?php endif; ?>
            <form action="options.php" method="post">
                <?php settings_fields( 'psy_bcb' ); ?>
                <table class="form-table" role="presentation">
                    <tr><th scope="row"><?php esc_html_e( 'Enabled post types', 'block-content-bridge' ); ?></th><td>
                        <input type="hidden" name="psy_bcb_options[post_types][]" value="">
                        <?php foreach ( self::post_types() as $name => $type ) : ?>
                            <label><input type="checkbox" name="psy_bcb_options[post_types][]" value="<?php echo esc_attr( $name ); ?>" <?php checked( in_array( $name, $options['post_types'], true ) ); ?>> <?php echo esc_html( $type->label ); ?></label><br>
                        <?php endforeach; ?>
                    </td></tr>
                    <tr><th scope="row"><label for="psy-bcb-blocks"><?php esc_html_e( 'Excluded block types', 'block-content-bridge' ); ?></label></th><td>
                        <select multiple size="8" id="psy-bcb-blocks" name="psy_bcb_options[excluded_blocks][]">
                            <?php foreach ( \WP_Block_Type_Registry::get_instance()->get_all_registered() as $name => $block ) : ?>
                                <option value="<?php echo esc_attr( $name ); ?>" <?php selected( in_array( $name, $options['excluded_blocks'], true ) ); ?>><?php echo esc_html( ( $block->title ?: $name ) . ' (' . $name . ')' ); ?></option>
                            <?php endforeach; ?>
                        </select>
                        <p class="description"><?php esc_html_e( 'Excluded blocks and everything inside them are omitted from analysis only.', 'block-content-bridge' ); ?></p>
                    </td></tr>
                    <tr><th scope="row"><label for="psy-bcb-refresh"><?php esc_html_e( 'Analysis updates', 'block-content-bridge' ); ?></label></th><td>
                        <select id="psy-bcb-refresh" name="psy_bcb_options[refresh]">
                            <option value="auto" <?php selected( $options['refresh'], 'auto' ); ?>><?php esc_html_e( 'Automatic', 'block-content-bridge' ); ?></option>
                            <option value="manual" <?php selected( $options['refresh'], 'manual' ); ?>><?php esc_html_e( 'Manual', 'block-content-bridge' ); ?></option>
                        </select>
                        <p class="description"><?php esc_html_e( 'Automatic updates run after you pause editing. Manual mode waits for Refresh analysis in the editor.', 'block-content-bridge' ); ?></p>
                    </td></tr>
                </table>
                <details><summary><?php esc_html_e( 'Advanced exclusions', 'block-content-bridge' ); ?></summary>
                    <p><label for="psy-bcb-selectors"><?php esc_html_e( 'CSS selectors to exclude, one per line', 'block-content-bridge' ); ?></label></p>
                    <textarea class="large-text code" rows="4" id="psy-bcb-selectors" name="psy_bcb_options[selectors]"><?php echo esc_textarea( implode( "\n", $options['selectors'] ) ); ?></textarea>
                    <p class="description"><?php esc_html_e( 'Selectors apply only to rendered post content. Developers can also add data-psy-analysis-ignore to an element in a block template.', 'block-content-bridge' ); ?></p>
                </details>
                <?php submit_button(); ?>
            </form>
            <p><?php esc_html_e( 'Psy Digital · hello@psydigital.co.uk', 'block-content-bridge' ); ?></p>
        </div>
        <?php
    }
}
