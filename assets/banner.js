#!/usr/bin/env node
/**
 * Rennie terminal banner — coral-coloured block text
 * Usage: node banner.js
 * Or import { printBanner } from './banner.js'
 */

// Coral palette ANSI 256-color codes
const CORAL = '\x1b[38;2;232;132;107m';    // #E8846B body
const DARK = '\x1b[38;2;204;107;82m';      // #CC6B52 roof/accent
const DIM = '\x1b[38;2;180;100;80m';       // dimmer coral
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

const banner = [
  `${CORAL}  ██▀▀▄ █▀▀ █▄ █ █▄ █ ▀█▀ █▀▀`,
  `${CORAL}  █▀▀▄▀ █▀▀ █ ▀█ █ ▀█  █  █▀▀`,
  `${DARK}  ▀  ▀▀ ▀▀▀ ▀  ▀ ▀  ▀ ▀▀▀ ▀▀▀${RESET}  🏠`,
];

const mascot = [
  `${DARK}     ╻`,
  `${DARK}    ╱▔╲`,
  `${CORAL}   ╱▔▔▔▔▔╲`,
  `${CORAL}   ▏${RESET} ● ● ${CORAL}▕`,
  `${CORAL}   ▏${RESET}  ‿   ${CORAL}▕`,
  `${CORAL}   ▔▔╯ ╰▔▔▔${RESET}`,
];

function printBanner(version) {
  const v = version ? `${DIM}  v${version}${RESET}` : '';
  console.log('');
  banner.forEach(l => console.log(l));
  console.log(v);
  console.log('');
}

function printStartup(version) {
  const lines = [
    `${CORAL}  ██▀▀▄ █▀▀ █▄ █ █▄ █ ▀█▀ █▀▀${RESET}     ${DARK}╻${RESET}`,
    `${CORAL}  █▀▀▄▀ █▀▀ █ ▀█ █ ▀█  █  █▀▀${RESET}    ${DARK}╱▔╲${RESET}`,
    `${DARK}  ▀  ▀▀ ▀▀▀ ▀  ▀ ▀  ▀ ▀▀▀ ▀▀▀${RESET}  ${CORAL}╱▔▔▔▔▔╲${RESET}`,
    `${RESET}                                 ${CORAL}▏${RESET} ● ● ${CORAL}▕${RESET}`,
    `${DIM}  v${version || '0.7.0'} — renthero.com${RESET}         ${CORAL}▏${RESET}  ‿   ${CORAL}▕${RESET}`,
    `${RESET}                                 ${CORAL}▔▔╯ ╰▔▔▔${RESET}`,
  ];
  console.log('');
  lines.forEach(l => console.log(l));
  console.log('');
}

function printMascot() {
  console.log('');
  mascot.forEach(l => console.log(l));
  console.log('');
}

// Run directly
if (require.main === module) {
  const arg = process.argv[2] || 'startup';
  if (arg === 'banner') printBanner(process.argv[3]);
  else if (arg === 'mascot') printMascot();
  else printStartup(process.argv[3] || '0.7.0');
}

module.exports = { printBanner, printStartup, printMascot };
