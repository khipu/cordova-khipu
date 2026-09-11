var exec = require('cordova/exec');

var SERVICE = 'cordova-khipu';
var ACTION = 'startOperation';

/**
 * Starts a Khipu payment.
 *
 * Called with callbacks it returns nothing; called without them it returns a promise.
 * Both forms reach the same native code — the promise is a wrapper, not a second path.
 *
 * Note that the option names here are not the SDK's: `title` becomes the SDK's
 * `topBarTitle` and `titleImageUrl` becomes `topBarImageUrl`. The mapping lives in the
 * native mappers and the full vocabulary is declared in types/index.d.ts.
 *
 * @param {{operationId: string, options?: object}} call The payment and its options.
 * @param {function(object):void} [success] Called with a KhipuResult when the operation
 *   finished, including when the payer cancelled.
 * @param {function(object|string):void} [error] Called with a KhipuResult whose `result`
 *   is 'ERROR', or with a string when the failure happened before the operation started.
 * @returns {Promise<object>|undefined} A promise when no callbacks were given.
 * @throws {TypeError} When the call is invalid and only a success callback was given, so
 *   there is no error channel to report through.
 */
function startOperation (call, success, error) {
    // Validated here rather than in native, so a mistake in a merchant's own code is
    // reported the same way on both platforms and without a round trip.
    var invalid = whyInvalid(call);
    var wantsPromise = typeof success !== 'function' && typeof error !== 'function';

    if (wantsPromise) {
        return new Promise(function (resolve, reject) {
            if (invalid) {
                reject(new Error(invalid));
                return;
            }
            exec(resolve, reject, SERVICE, ACTION, [call]);
        });
    }

    if (invalid) {
        if (typeof error === 'function') {
            error(invalid);
            return undefined;
        }

        // Reached only when a caller passed a success callback and no error callback — a
        // shape the declarations do not offer. There is no channel left to report on, and
        // returning quietly would make the mistake disappear, so it is thrown instead.
        throw new TypeError(invalid);
    }

    exec(success, error, SERVICE, ACTION, [call]);

    return undefined;
}

// The wording matches the native checks on purpose: the same mistake should read the
// same whether it was caught here or on the other side of the bridge.
function whyInvalid (call) {
    if (call === null || typeof call !== 'object') {
        return 'startOperation expects an object as its first argument.';
    }

    if (typeof call.operationId !== 'string' || call.operationId.length === 0) {
        return 'operationId must be provided and must be a string.';
    }

    return null;
}

module.exports = {
    startOperation: startOperation
};
