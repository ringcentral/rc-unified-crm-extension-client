import React from 'react';
import ReactDOM from 'react-dom';
import Loading from './components/loading';
import ExpandableNote from './components/note/expandableNote';
import { RcThemeProvider } from '@ringcentral/juno';
import i18n from './i18n';

function App() {
    return (
        <RcThemeProvider>
            <Loading />
            <ExpandableNote />
        </RcThemeProvider>
    )
}
const container = document.getElementById('react-container');

i18n.restoreLocale().finally(() => {
    ReactDOM.render(<App />, container);
});
