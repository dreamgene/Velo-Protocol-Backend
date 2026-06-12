module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'test', 'chore', 'ci', 'refactor', 'perf', 'security', 'infra', 'brand', 'ops', 'db', 'legal'],
    ],
  },
};
