openssl genrsa -out ./keys/client-key.pem 1024
openssl req -new -key ./keys/client-key.pem -config ./keys/cert-request.cnf -out ./keys/client-csr.pem
openssl x509 -req -in ./keys/client-csr.pem -signkey ./keys/client-key.pem -out ./keys/client-cert.pem
openssl genrsa -out ./keys/server-key.pem 1024
openssl req -new -key ./keys/server-key.pem -config ./keys/cert-request.cnf -out ./keys/server-csr.pem
openssl x509 -req -in ./keys/server-csr.pem -signkey ./keys/server-key.pem -out ./keys/server-cert.pem -extensions v3_ca -extfile ./keys/extensions.cnf
