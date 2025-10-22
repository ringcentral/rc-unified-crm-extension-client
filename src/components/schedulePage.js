/**
 * Creates a schedule page configuration for the call-down list functionality
 * @param {Object} params - Parameters for creating the schedule page
 * @param {string} params.phoneNumber - The phone number to schedule
 * @param {Array} params.listOneOf - Array of contact options for the dropdown
 * @param {boolean} params.isDefaultNew - Whether to default to creating a new contact
 * @param {string} params.preselect - The preselected contact value
 * @param {Array} params.contactTypes - Array of contact types for the platform
 * @returns {Object} The schedule page configuration object
 */
function createSchedulePage({ phoneNumber, listOneOf, isDefaultNew, preselect, contactTypes = [] }) {
  return {
    id: 'c2dSchedulePage',
    title: 'Add to call-down list',
    type: 'page',
    schema: {
      type: 'object',
      required: ['callbackDateTime'],
      properties: {
        phone: { type: 'string', title: 'Phone Number' },
        contact: { type: 'string', title: 'Contact', oneOf: listOneOf },
        newContactName: { type: 'string', title: 'New contact name' },
        ...(contactTypes.length > 0 ? { 
          newContactType: { 
            type: 'string', 
            title: 'Contact type', 
            oneOf: contactTypes.map(t => ({ 
              const: t.value, 
              title: t.display 
            })) 
          } 
        } : {}),
        callbackDateTime: { 
          type: 'string', 
          title: 'Schedule time', 
          format: 'date-time', 
          minimum: new Date().toISOString() 
        },
        scheduleSubmit: { type: 'string', title: 'Schedule' },
      }
    },
    uiSchema: {
      phone: { 'ui:disabled': true },
      contact: {},
      newContactName: isDefaultNew ? { 
        'ui:widget': 'text', 
        'ui:placeholder': 'Enter name...' 
      } : { 
        'ui:widget': 'hidden' 
      },
      ...(contactTypes.length > 0 ? { 
        newContactType: isDefaultNew ? {} : { 'ui:widget': 'hidden' } 
      } : {}),
      callbackDateTime: { 'ui:widget': 'datetime' },
      scheduleSubmit: { 
        'ui:field': 'button', 
        'ui:variant': 'contained', 
        'ui:id': 'scheduleSubmit', 
        'ui:disabled': true 
      },
    },
    formData: { 
      phone: phoneNumber, 
      contact: preselect, 
      newContactName: '', 
      newContactType: isDefaultNew && contactTypes.length > 0 ? 
        contactTypes[0].value : '', 
      callbackDateTime: '' 
    }
  };
}

export default createSchedulePage;
