import { t } from '../i18n';

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
function getSchedulePageRender({ phoneNumber, listOneOf, isDefaultNew, preselect, contactTypes = [] }) {
  return {
    id: 'c2dSchedulePage',
    title: t('pages.schedule.title'),
    type: 'page',
    schema: {
      type: 'object',
      required: ['callbackDateTime'],
      properties: {
        phone: { type: 'string', title: t('pages.schedule.phoneNumber') },
        contact: { type: 'string', title: t('common.labels.contact'), oneOf: listOneOf },
        newContactName: { type: 'string', title: t('pages.log.newContactName') },
        ...(contactTypes.length > 0 ? { 
          newContactType: { 
            type: 'string', 
            title: t('pages.log.contactType'), 
            oneOf: contactTypes.map(t => ({ 
              const: t.value, 
              title: t.display 
            })) 
          } 
        } : {}),
        callbackDateTime: { 
          type: 'string', 
          title: t('pages.schedule.scheduleTime'), 
          format: 'date-time',
          minimum: new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
        },
        scheduleSubmit: { type: 'string', title: t('common.buttons.schedule') },
      }
    },
    uiSchema: {
      phone: { 'ui:disabled': true },
      contact: {},
      newContactName: isDefaultNew ? { 
        'ui:widget': 'text', 
        'ui:placeholder': t('pages.log.enterName') 
      } : { 
        'ui:widget': 'hidden' 
      },
      ...(contactTypes.length > 0 ? { 
        newContactType: isDefaultNew ? {} : { 'ui:widget': 'hidden' } 
      } : {}),
      callbackDateTime: { 
        'ui:widget': 'datetime',
        'ui:options': {
          minimum: new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
        }
      },
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

exports.getSchedulePageRender = getSchedulePageRender;
