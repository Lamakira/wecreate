# Separate payment truth from fulfillment

Payment State and Fulfillment State will be tracked independently, with immutable payment events preserved even when email or Paid Deliverable access fails. This adds explicit state handling but prevents fulfillment errors, duplicate callbacks, or manual intervention from corrupting the financial truth or triggering duplicate delivery.
