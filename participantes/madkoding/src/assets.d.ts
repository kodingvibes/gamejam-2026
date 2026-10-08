// Vite asset imports resolved to URLs.
declare module '*.webp?url' {
  const url: string;
  export default url;
}
