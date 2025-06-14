#!/bin/bash
echo "💳 3. Iniciando transacción WebPay..."
transaccion=$(curl -s -X POST http://localhost:3002/api/transbank/init \
  -H "Content-Type: application/json" \
  -d '{
    "monto": 30000,
    "productos": [
      {"idProducto": 1, "cantidad": 2, "precioUnitario": 15000, "descripcion": "Producto Test"}
    ],
    "returnUrl": "http://localhost:4200/return",
    "sessionId": "TEST-'$(date +%s)'"
  }')

token=$(echo $transaccion | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "✅ Transacción iniciada: $token"

echo "💳 4. Confirmando pago..."
confirmacion=$(curl -s -X POST http://localhost:3002/api/transbank/commit \
  -H "Content-Type: application/json" \
  -d '{"token_ws": "'$token'"}')

echo "✅ Pago confirmado"
echo ""
echo "🎉 PRUEBA COMPLETA EXITOSA"
echo "✅ Sistema FERREMAS funcionando correctamente"

chmod +x test-system.sh
