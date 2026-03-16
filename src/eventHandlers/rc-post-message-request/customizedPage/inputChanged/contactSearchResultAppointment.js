// For Appointment contact search results we support multi-select via checkboxes.
// Selecting/unselecting should NOT navigate away; we apply selection only on "Add" submit.

async function onEvent({ data, manifest, platformName }) {
  // Intentionally no-op: keep user on the results page while they select multiple contacts.
  // The "Add" (page submit) handler applies selected contacts to the appointment draft.
  void data;
  void manifest;
  void platformName;
}

exports.onEvent = onEvent;

