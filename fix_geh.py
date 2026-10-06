with open('backend/src/main/java/com/tracex/exception/GlobalExceptionHandler.java', 'r', encoding='utf-8') as f:
    text = f.read()

import_line = 'import org.springframework.dao.OptimisticLockingFailureException;\n'
text = text.replace('import org.springframework.web.bind.MethodArgumentNotValidException;', 'import org.springframework.web.bind.MethodArgumentNotValidException;\n' + import_line)

handler_code = '''
    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<ApiResponse<Void>> handleOptimisticLockingFailureException(OptimisticLockingFailureException ex) {
        logger.warn("Optimistic locking failure: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error(ErrorCode.CONFLICT, "Resource was modified concurrently. Please retry."));
    }
'''

last_brace = text.rfind('}')
text = text[:last_brace] + handler_code + '\n}'

with open('backend/src/main/java/com/tracex/exception/GlobalExceptionHandler.java', 'w', encoding='utf-8') as f:
    f.write(text)
