#!/usr/bin/env node
// Prints an xcodebuild -destination for an iOS simulator that actually exists here.
//
// `-destination 'platform=iOS Simulator,name=iPhone 16'` is what CI uses, and it works there,
// but it resolves to OS:latest — so on a machine whose newest installed runtime has no iPhone 16
// it fails with "Unable to find a device matching the provided destination specifier", and the
// whole verify chain stops before it reaches the Android suite. Pinning a runtime instead just
// moves the problem to whoever does not have that one.
//
// So: ask the machine. Pick the newest runtime that actually has an iPhone, and address the device
// by id, which is unambiguous.
const { execFileSync } = require('node:child_process');

function newestIPhone () {
    const listed = JSON.parse(
        execFileSync('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], { encoding: 'utf-8' })
    ).devices;

    const candidates = Object.entries(listed)
        .filter(([runtime]) => runtime.includes('iOS'))
        .flatMap(([runtime, devices]) => devices
            .filter(device => device.isAvailable && device.name.startsWith('iPhone'))
            .map(device => ({ udid: device.udid, name: device.name, version: version(runtime) })));

    if (candidates.length === 0) {
        throw new Error('no available iPhone simulator on this machine');
    }

    // Newest runtime first, so the tests run against what a developer is most likely shipping for.
    candidates.sort((left, right) => compare(right.version, left.version));

    return candidates[0];
}

// "com.apple.CoreSimulator.SimRuntime.iOS-18-5" -> [18, 5]
function version (runtime) {
    const parts = runtime.split('iOS-')[1];
    return parts ? parts.split('-').map(Number) : [0];
}

function compare (left, right) {
    for (let index = 0; index < Math.max(left.length, right.length); index++) {
        const difference = (left[index] || 0) - (right[index] || 0);
        if (difference !== 0) {
            return difference;
        }
    }
    return 0;
}

if (require.main === module) {
    process.stdout.write(`id=${newestIPhone().udid}`);
}

module.exports = { newestIPhone };
