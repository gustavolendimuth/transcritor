export function resolveApiPort(env: NodeJS.ProcessEnv): number {
  return Number(env.PORT ?? env.API_PORT ?? 3011);
}
