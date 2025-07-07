import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import OAuthGoogle from "./components/Oauth"
function App() {

  return (
    <Router>
      <Routes>
        <Route path="/authorize" element={<OAuthGoogle />} />
        <Route path="/auth/callback" element={<OAuthGoogle />} />
        {/* Other routes */}
      </Routes>
    </Router>
  )
}

export default App
