<?php
/**
 * Plugin Name: Block Content Bridge
 * Description: Supplies rendered block-editor content to Yoast SEO analysis, including dynamic ACF blocks.
 * Version: 0.1.0
 * Author: Psy Digital
 * Author URI: https://psydigital.co.uk
 * Plugin URI: https://github.com/psydigital/block-content-bridge
 * Requires at least: 6.6
 * Requires PHP: 8.1
 * License: GPL-3.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-3.0.html
 * Text Domain: block-content-bridge
 * Update URI: https://github.com/psydigital/block-content-bridge
 */

namespace PsyDigital\BlockContentBridge;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

const VERSION = '0.1.0';
const FILE = __FILE__;

require_once __DIR__ . '/includes/Settings.php';
require_once __DIR__ . '/includes/Renderer.php';
require_once __DIR__ . '/includes/Plugin.php';

add_action( 'plugins_loaded', [ Plugin::class, 'boot' ] );
