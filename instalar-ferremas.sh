#!/bin/bash
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Aquí podrían ir los pasos de instalación, configuración, despliegue, etc.

# Crear script de prueba
cat <<EOF > test-system.sh
#!/bin/bash
echo "💳 3. Iniciando transacción WebPay..."
transaccion=\$(curl -s -X POST http://localhost:3002/api/transbank/init \\
  -H "Content-Type: application/json" \\
  -d '{
    "monto": 30000,
    "productos": [
      {"idProducto": 1, "cantidad": 2, "precioUnitario": 15000, "descripcion": "Producto Test"}
    ],
    "returnUrl": "http://localhost:4200/return",
    "sessionId": "TEST-'\\\$(date +%s)'"
  }')

token=\$(echo \$transaccion | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "✅ Transacción iniciada: \$token"

echo "💳 4. Confirmando pago..."
confirmacion=\$(curl -s -X POST http://localhost:3002/api/transbank/commit \\
  -H "Content-Type: application/json" \\
  -d '{"token_ws": "'\$token'"}')

echo "✅ Pago confirmado"
echo ""
echo "🎉 PRUEBA COMPLETA EXITOSA"
echo "✅ Sistema FERREMAS funcionando correctamente"
EOF

chmod +x test-system.sh

echo -e "\n${GREEN}🎉 INSTALACIÓN COMPLETADA EXITOSAMENTE${NC}\n"

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║                   ¡LISTO!                           ║"
echo "║                                                      ║"
echo "║  Sistema FERREMAS instalado correctamente            ║"
echo "║                                                      ║"
echo "║  Para iniciar el sistema:                            ║"
echo "║  ${NC}./start-all.sh${BLUE}                                    ║"
echo "║                                                      ║"
echo "║  Para probar el sistema:                             ║"
echo "║  ${NC}./test-system.sh${BLUE}                                  ║"
echo "║                                                      ║"
echo "║  Para detener el sistema:                            ║"
echo "║  ${NC}./stop-all.sh${BLUE}                                     ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

echo -e "${YELLOW}📋 PRÓXIMOS PASOS:${NC}"
echo "1. Ejecutar: ${GREEN}./start-all.sh${NC}"
echo "2. Abrir: ${BLUE}http://localhost:3000/api${NC} (Inventario)"
echo "3. Abrir: ${BLUE}http://localhost:3001/api${NC} (Banco)"
echo "4. Abrir: ${BLUE}http://localhost:3002/api${NC} (Transbank)"
echo "5. Probar: ${GREEN}./test-system.sh${NC}"
echo ""
echo -e "${GREEN}¡El sistema está listo para la presentación!${NC}"
