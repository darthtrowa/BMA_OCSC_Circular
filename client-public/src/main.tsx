import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import 'sweetalert2/dist/sweetalert2.min.css'
import './styles/custom.css'
import moment from 'moment/min/moment-with-locales'

moment.locale('th')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
