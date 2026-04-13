declare namespace Bun {
  interface Server {
    readonly port: number;
    stop(): void;
  }

  interface ServeOptions {
    port?: number;
    fetch(request: Request): Response | Promise<Response>;
  }

  function serve(options: ServeOptions): Server;
}
