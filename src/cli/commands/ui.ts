import chalk from 'chalk';
import { startServer } from '../../ui/server';

const PORT = 3000;

export async function uiCommand(port: number = PORT): Promise<void> {
  await startServer({ port, auth: false });
}