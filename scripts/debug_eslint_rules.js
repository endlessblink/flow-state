import pluginVue from 'eslint-plugin-vue';

const checkConfig = (name) => {
    const config = pluginVue.configs[name];
    console.log(`\n--- Config: ${name} ---`);
    console.log('Type:', Array.isArray(config) ? 'Array (Flat)' : typeof config);

    if (Array.isArray(config)) {
        // Flatten rules to check
        let ruleValue = 'undefined';
        config.forEach(c => {
            if (c.rules && c.rules['vue/no-multiple-template-root']) {
                ruleValue = c.rules['vue/no-multiple-template-root'];
            }
        });
        console.log('vue/no-multiple-template-root:', ruleValue);
    } else if (config.rules) {
        console.log('vue/no-multiple-template-root:', config.rules['vue/no-multiple-template-root']);
    }
};

checkConfig('flat/recommended');
checkConfig('flat/vue2-recommended');
checkConfig('vue3-recommended');
