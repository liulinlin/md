import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  typescript: true,
  formatters: true,
  ignores: [`reference/**`, `.github/**`, `scripts/**`, `docker/**`, `packages/md-cli/**`, `src/assets/**`, `example/**`, 'apps/web/src/assets/example/markdown.md'],
}, {
  rules: {
    'semi': [`error`, `never`],
    'no-unused-vars': `off`,
    'no-console': `off`,
    'no-debugger': `off`,
    'ts/no-namespace': `off`,
    'style/max-statements-per-line': `off`,
  },
})
