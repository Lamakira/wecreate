---
status: superseded by ADR-0006
---

# Separate digital orders from service reservations

Digital Products will use an immediate guest checkout, while service offers will start a Reservation Request that WeCreate must approve before issuing a dedicated FedaPay deposit link. This deliberately replaces the brief's mixed-cart model: availability-dependent services cannot safely share an instant checkout with automatically fulfilled downloads, and a Service Reservation is confirmed only after FedaPay's webhook confirms the deposit during the 48-hour Availability Hold.
