var exec = require('cordova/exec');
var Khipu = {
        startOperation: function (call, success, error) {
                exec(success, error, 'cordova-khipu', 'startOperation', [call]);
        }
}
module.exports = Khipu;
