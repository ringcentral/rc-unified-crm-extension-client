type EventOptions = {
  data: unknown;
};

export async function onEvent({ data }: EventOptions): Promise<void> {
  console.log('rc-calling-settings-notify:', data);
}

export default {
  onEvent,
};
