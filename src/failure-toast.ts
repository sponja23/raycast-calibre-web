import { Toast, openExtensionPreferences, showToast } from "@raycast/api";
import { Failure } from "./failure";

export async function showFailure(failure: Failure | undefined, toast?: Toast): Promise<void> {
  if (!failure) {
    await toast?.hide();
    return;
  }
  const primaryAction = failure.fixInPreferences
    ? { title: "Open Preferences", onAction: () => openExtensionPreferences() }
    : undefined;
  if (!toast) {
    await showToast({ style: Toast.Style.Failure, title: failure.title, message: failure.message, primaryAction });
    return;
  }
  toast.style = Toast.Style.Failure;
  toast.title = failure.title;
  toast.message = failure.message;
  toast.primaryAction = primaryAction;
}
