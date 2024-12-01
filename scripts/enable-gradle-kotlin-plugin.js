const fs = require('fs');
const path = require('path');

module.exports = function (context) {
    const gradleConfigPath = path.join(
        context.opts.projectRoot,
        'platforms',
        'android',
        'cdv-gradle-config.json'
    );

    if (fs.existsSync(gradleConfigPath)) {
        const gradleConfig = require(gradleConfigPath);
        gradleConfig.IS_GRADLE_PLUGIN_KOTLIN_ENABLED = true;

        fs.writeFileSync(
            gradleConfigPath,
            JSON.stringify(gradleConfig, null, 4),
            'utf-8'
        );

        console.log('Updated cdv-gradle-config.json: IS_GRADLE_PLUGIN_KOTLIN_ENABLED = true');
    } else {
        console.warn('cdv-gradle-config.json not found!');
    }
};
