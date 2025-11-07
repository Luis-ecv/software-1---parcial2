class ValidationUtils {
    
    static generateValidationAnnotations(attr) {
        let annotations = '';
        
        if (!attr.isPrimaryKey) {
            if (attr.type === 'String') {
                annotations += '    @NotBlank(message = "' + attr.name + ' no puede estar vacío")\n';
                if (attr.sqlType && attr.sqlType.includes('VARCHAR')) {
                    const length = attr.sqlType.match(/\d+/)?.[0] || '255';
                    annotations += `    @Size(max = ${length}, message = "${attr.name} no puede exceder ${length} caracteres")\n`;
                }
            } else if (attr.type === 'Integer' || attr.type === 'Long') {
                annotations += '    @NotNull(message = "' + attr.name + ' no puede ser nulo")\n';
                annotations += '    @Min(value = 0, message = "' + attr.name + ' debe ser mayor o igual a 0")\n';
            } else if (attr.type === 'Double' || attr.type === 'BigDecimal') {
                annotations += '    @NotNull(message = "' + attr.name + ' no puede ser nulo")\n';
                annotations += '    @DecimalMin(value = "0.0", message = "' + attr.name + ' debe ser mayor o igual a 0")\n';
            } else if (attr.type === 'LocalDate' || attr.type === 'Date') {
                annotations += '    @NotNull(message = "' + attr.name + ' no puede ser nulo")\n';
                annotations += '    @PastOrPresent(message = "' + attr.name + ' no puede ser una fecha futura")\n';
            } else {
                annotations += '    @NotNull(message = "' + attr.name + ' no puede ser nulo")\n';
            }
        }
        
        return annotations;
    }

    static generateCustomValidation(entity) {
        return `
/**
 * Validación personalizada para ${entity.name}
 */
// @ValidEntity // Descomentar si se implementa validador personalizado
`;
    }
}

export default ValidationUtils;