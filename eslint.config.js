import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'functions/**/*']
  },
  firebaseRulesPlugin.configs['flat/recommended']
];
