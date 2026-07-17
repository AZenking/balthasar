export const OFFLINE_WRITE_MESSAGE = "当前离线，操作未保存且不会排队。";

/** Returns false without invoking `write` while browser connectivity is offline. */
export function guardOnlineWrite(
  online: boolean,
  write: () => void,
  notify: (message: string) => void
): boolean {
  if (!online) {
    notify(OFFLINE_WRITE_MESSAGE);
    return false;
  }
  write();
  return true;
}
