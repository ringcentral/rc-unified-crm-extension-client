async function onEvent({data}){
    console.log('rc-calling-settings-notify:', data);
}

exports.onEvent = onEvent;