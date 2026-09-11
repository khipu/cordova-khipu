const assert = require('node:assert');
const Module = require('node:module');
const { test } = require('node:test');

// `cordova/exec` only exists inside a Cordova webview. Intercepting require is how the
// module under test can be loaded here at all, and it keeps www/cordova-khipu.js in the
// exact shape Cordova expects rather than bending it for testability.
const calls = [];
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id) {
    if (id === 'cordova/exec') {
        return function (success, error, service, action, args) {
            calls.push({ success, error, service, action, args });
        };
    }
    return originalRequire.apply(this, arguments);
};

const Khipu = require('../../www/cordova-khipu.js');

test.afterEach(() => {
    calls.length = 0;
});

test('passes the call through to the native side', () => {
    const success = () => {};
    const error = () => {};

    Khipu.startOperation({ operationId: 'op-1', options: { title: 'Demo' } }, success, error);

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].service, 'cordova-khipu');
    assert.strictEqual(calls[0].action, 'startOperation');
    assert.deepStrictEqual(calls[0].args, [{ operationId: 'op-1', options: { title: 'Demo' } }]);
    assert.strictEqual(calls[0].success, success);
});

test('rejects a missing operationId without crossing to native', () => {
    let failure = null;

    Khipu.startOperation({ options: {} }, () => {}, (error) => { failure = error; });

    assert.strictEqual(calls.length, 0, 'nothing should have reached the native side');
    assert.strictEqual(failure, 'operationId must be provided and must be a string.');
});

test('rejects a non-string operationId', () => {
    let failure = null;

    Khipu.startOperation({ operationId: 42 }, () => {}, (error) => { failure = error; });

    assert.strictEqual(calls.length, 0);
    assert.match(failure, /must be a string/);
});

test('rejects a call that is not an object', () => {
    let failure = null;

    Khipu.startOperation('op-1', () => {}, (error) => { failure = error; });

    assert.strictEqual(calls.length, 0);
    assert.match(failure, /expects an object/);
});

test('returns a promise when no callbacks are given', async () => {
    const pending = Khipu.startOperation({ operationId: 'op-1' });

    assert.ok(pending instanceof Promise);
    assert.strictEqual(calls.length, 1);

    calls[0].success({ operationId: 'op-1', result: 'OK' });

    assert.deepStrictEqual(await pending, { operationId: 'op-1', result: 'OK' });
});

test('the promise rejects with what native sent', async () => {
    const pending = Khipu.startOperation({ operationId: 'op-1' });

    calls[0].error({ operationId: 'op-1', result: 'ERROR', failureReason: 'USER_CANCELED' });

    await assert.rejects(pending, (thrown) => thrown.failureReason === 'USER_CANCELED');
});

test('the promise rejects on invalid input without crossing to native', async () => {
    await assert.rejects(Khipu.startOperation({}), /operationId must be provided/);
    assert.strictEqual(calls.length, 0);
});

test('returns undefined when callbacks are given', () => {
    assert.strictEqual(Khipu.startOperation({ operationId: 'op-1' }, () => {}, () => {}), undefined);
});
