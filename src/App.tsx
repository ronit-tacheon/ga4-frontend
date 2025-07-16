import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import OAuthGoogle from "./components/Oauth"
import Payment from "./components/Payment"
function App() {

  return (
    <Router>
      <Routes>
        <Route path="/authorize" element={<OAuthGoogle />} />
        <Route path="/auth/callback" element={<OAuthGoogle />} />
        {/* new route of payment added */}
        <Route
          path="/payment"
          element={
            <Payment
              amount={100}
              currency="INR"
              user_email="user@example.com"
            />
          }
        />
        {/* Other routes */}
      </Routes>
    </Router>
  )
}

export default App
