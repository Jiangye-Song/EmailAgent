export const redirect = (url: string): never => {
  throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url}` });
};
export const notFound = (): never => {
  throw new Error("NEXT_NOT_FOUND");
};
