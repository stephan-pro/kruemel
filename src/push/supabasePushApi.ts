// `PushApi` against the real project (NT-a): switching on and off through the database functions
// `register_push_device` / `unregister_push_device`, the test through the Edge Function `push`
// (route `test`, in Paris like the database). supabase-js sends the person's sign-in along.

import {
  FunctionRegion,
  FunctionsFetchError,
  FunctionsHttpError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import {
  isPushFailure,
  type PushFailure,
  type PushSettings,
  raisedPushFailure,
  SETTINGS_COLUMNS,
  type SettingsRow,
  settingsArguments,
  settingsFromRow,
} from "../../supabase/functions/push/rules";
import { type DeviceRegistration, type PushApi, PushError } from "./pushApi";

/** A failed database call: what it raised, else "offline" when the service was not reached. */
function rpcFailure(error: { readonly message: string; readonly code?: string }): PushError {
  return new PushError(
    raisedPushFailure(error.message) ??
      (error.code === undefined || error.code === "" ? "offline" : "unknown"),
  );
}

/** A failed call of the Edge Function: its code (`{"error": …}`), else offline or unknown. */
async function functionFailure(error: unknown): Promise<PushError> {
  if (error instanceof FunctionsFetchError) {
    return new PushError("offline");
  }
  if (error instanceof FunctionsHttpError) {
    const body = (await (error.context as Response).json().catch(() => null)) as {
      error?: unknown;
    } | null;
    const failure: PushFailure = isPushFailure(body?.error) ? body.error : "unknown";
    return new PushError(failure);
  }
  return new PushError("unknown");
}

export class SupabasePushApi implements PushApi {
  constructor(private readonly client: SupabaseClient) {}

  async register(device: DeviceRegistration): Promise<void> {
    const { error } = await this.client.rpc("register_push_device", {
      p_device_id: device.deviceId,
      p_endpoint: device.endpoint,
      p_p256dh: device.p256dh,
      p_auth: device.auth,
      p_key_id: device.keyId,
      p_time_zone: device.timeZone,
      p_locale: device.locale,
    });
    if (error) {
      throw rpcFailure(error);
    }
  }

  async unregister(deviceId: string): Promise<void> {
    const { error } = await this.client.rpc("unregister_push_device", { p_device_id: deviceId });
    if (error) {
      throw rpcFailure(error);
    }
  }

  async settings(deviceId: string): Promise<PushSettings | null> {
    // Row level security lets a person read only their own devices.
    const { data, error } = await this.client
      .from("push_devices")
      .select(SETTINGS_COLUMNS)
      .eq("device_id", deviceId)
      .maybeSingle();
    if (error) {
      throw rpcFailure(error);
    }
    return data === null ? null : settingsFromRow(data as unknown as SettingsRow);
  }

  async updateSettings(deviceId: string, settings: PushSettings): Promise<void> {
    const { error } = await this.client.rpc("update_push_settings", {
      p_device_id: deviceId,
      ...settingsArguments(settings),
    });
    if (error) {
      throw rpcFailure(error);
    }
  }

  async sendTest(deviceId: string): Promise<void> {
    const { error } = await this.client.functions.invoke("push/test", {
      body: { deviceId },
      region: FunctionRegion.EuWest3,
    });
    if (error) {
      throw await functionFailure(error);
    }
  }
}
