import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

interface PaymentProps {
  amount: number;
  currency: string;
  user_email: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}
const razorpay_key_id = import.meta.env.VITE_RAZORPAY_KEY_ID;
const Payment: React.FC<PaymentProps> = ({ 
  amount, 
  currency, 
  user_email 
}) => {
  const [searchParams] = useSearchParams();
  const redirectUri = searchParams.get('redirect_uri') || "";
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handlePayment = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    
    const options = {
      key: razorpay_key_id,
      amount: amount,
      currency: currency,
      name: "GA4 Claude Extension",
      description: "Access Google Analytics 4 in Claude",
      handler: function (response: any) {
        fetch("/payment/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature || 'no-signature'
          })
        })
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            window.location.href = redirectUri;
          } else {
            alert("Payment verification failed");
          }
        })
        .catch(err => alert("Payment verification failed: " + err));
      },
      prefill: {
        email: user_email
      },
      theme: {
        color: "#0045a0"
      },
      modal: {
      ondismiss: function() {
        // This ensures the modal can be reopened
        console.log('Payment modal dismissed');
      }
    },
    retry: {
      enabled: true,
      max_count: 3
    }
    };
    
    const rzp1 = new window.Razorpay(options);
    rzp1.open();
  };

  const handleBackToHome = () => {
    window.location.href ="/"
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-800 to-green-400 flex items-center justify-center p-5">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
        
        <img 
          src="/static/smacient-green-new.png" 
          alt="Smacient Logo" 
          className="w-24 mx-auto mb-6"
        />
        
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          Complete Your Payment
        </h1>
        
        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <p className="text-gray-600 mb-2">
            Generate your personalized GA4 Claude Extension
          </p>
          <div className="text-2xl font-bold text-blue-800 mb-2">
            $10 USD
          </div>
          <p className="text-gray-600">
            One-time payment • Instant delivery
          </p>
        </div>
        
        <button 
          className="bg-blue-600 text-white py-3 px-8 rounded-lg font-semibold hover:bg-blue-700 mb-6 w-full"
          onClick={handlePayment}
        >
          Proceed with Payment
        </button>

        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <h3 className="font-semibold text-gray-800 mb-2">
            🔒 Secure Payment
          </h3>
          <p className="text-sm text-gray-600">
            Your payment is processed securely through Razorpay. We never store your card information.
          </p>
        </div>

        <button 
          className="bg-gray-200 text-gray-700 py-2 px-6 rounded-lg hover:bg-gray-300"
          onClick={handleBackToHome}
        >
          Back to Home
        </button>
        
      </div>
    </div>
  );
};

export default Payment;