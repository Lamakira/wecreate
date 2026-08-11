# Cache public pages and colocate transactions

The public portfolio and catalogue will be statically generated or cached at the edge, while Supabase is contacted only for transactional actions such as checkout, reservations, order access, and protected downloads. The Next.js server functions and Supabase project will be colocated in Paris and validated on MTN and Moov mobile networks before launch, accepting managed-service dependency in exchange for lower operational burden without putting database latency on the browsing path.
