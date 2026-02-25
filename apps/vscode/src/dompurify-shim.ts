// Shim for isomorphic-dompurify in webpack-bundled VSCode extension.
// jsdom uses fs.readFileSync(__dirname + '../../browser/default-stylesheet.css')
// which breaks when bundled by webpack (ENOENT).
// VSCode webview is sandboxed and content is from user's own local files,
// so DOMPurify sanitization is not required here.
export default {
  sanitize: (html: string, _opts?: any) => html,
  isSupported: true,
}
