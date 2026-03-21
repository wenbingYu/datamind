/**
 * Serve CLI 命令
 * 启动 API 服务器
 */

import chalk from 'chalk';
import { startServer, ServerOptions } from '../../ui/server';

export async function serveCommand(options: { port: string; auth: boolean; host: string }): Promise<void> {
  const serverOptions: ServerOptions = {
    port: parseInt(options.port) || 3000,
    auth: options.auth,
    host: options.host
  };
  
  await startServer(serverOptions);
}