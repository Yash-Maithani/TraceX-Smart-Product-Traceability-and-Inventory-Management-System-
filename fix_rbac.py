import re

with open('backend/src/test/java/com/tracex/RbacMatrixTest.java', 'r', encoding='utf-8') as f:
    content = f.read()

# Update display name
content = content.replace('Phase <= 2', 'Phase <= 3')
content = content.replace('testRbacMatrixPhaseLeq2', 'testRbacMatrixPhaseLeq3')

# Update phase > 2 to phase > 3
content = content.replace('if (phase > 2) {', 'if (phase > 3) {')

# Find the loop body and replace it
loop_body_start = content.find('evaluatedRowCount++;')
loop_body_end = content.find('logger.info(\"Generated {} dynamic tests', loop_body_start)

new_loop_body = '''
            evaluatedRowCount++;
            String method = parts[1].trim().toUpperCase();
            String rawPath = parts[2].trim();
            
            // New CSV format has 'anonymous' at index 9, 'notes' at index 10 (or omitted if empty)
            String anonymousRule = parts.length > 9 ? parts[9].trim().toLowerCase() : "deny";
            String notes = parts.length > 10 ? parts[10].trim() : "";
            boolean isPublic = "allow".equals(anonymousRule);

            // Add dynamic test for anonymous access
            String anonTestName = String.format("Phase %d [anonymous] %s %s -> %s", phase, method, rawPath, anonymousRule);
            tests.add(DynamicTest.dynamicTest(anonTestName, () -> {
                String resolvedPath = rawPath.replace(":id", NON_EXISTENT_ID);
                MockHttpServletRequestBuilder anonReq = MockMvcRequestBuilders
                        .request(HttpMethod.valueOf(method), URI.create(resolvedPath))
                        .contentType(MediaType.APPLICATION_JSON);
                
                if (method.equals("POST") || method.equals("PATCH") || method.equals("PUT")) {
                    anonReq.content("{}");
                }
                
                if ("deny".equals(anonymousRule)) {
                    mockMvc.perform(anonReq)
                            .andExpect(status().isUnauthorized())
                            .andExpect(jsonPath("$.code").value(ErrorCode.AUTH_NO_TOKEN));
                } else {
                    // For allowed, it shouldn't be 401 or 403
                    mockMvc.perform(anonReq)
                            .andExpect(result -> {
                                int status = result.getResponse().getStatus();
                                org.assertj.core.api.Assertions.assertThat(status)
                                    .isNotIn(401, 403);
                            });
                }
            }));

            for (int r = 0; r < roles.size(); r++) {
                String role = roles.get(r);
                String expectedPermission = parts[3 + r].trim().toLowerCase();

                String testName = String.format("Phase %d [%s] %s %s -> %s", phase, role, method, rawPath, expectedPermission);

                tests.add(DynamicTest.dynamicTest(testName, () -> {
                    String resolvedPath = rawPath.replace(":id", NON_EXISTENT_ID);
                    HttpMethod httpMethod = HttpMethod.valueOf(method);

                    MockHttpServletRequestBuilder requestBuilder = MockMvcRequestBuilders
                            .request(httpMethod, URI.create(resolvedPath))
                            .contentType(MediaType.APPLICATION_JSON);

                    if (isPublic) {
                        // Public endpoints do not send token
                    } else {
                        String token = getTokenForRole(role);
                        requestBuilder.header("Authorization", "Bearer " + token);
                    }

                    if (method.equals("POST") || method.equals("PATCH") || method.equals("PUT")) {
                        requestBuilder.content("{}");
                    }

                    if ("deny".equals(expectedPermission)) {
                        mockMvc.perform(requestBuilder)
                                .andExpect(status().isForbidden())
                                .andExpect(jsonPath("$.code").value(ErrorCode.RBAC_INSUFFICIENT));
                    } else if ("allow".equals(expectedPermission)) {
                        mockMvc.perform(requestBuilder)
                                .andExpect(result -> {
                                    int status = result.getResponse().getStatus();
                                    org.assertj.core.api.Assertions.assertThat(status)
                                        .isNotIn(401, 403);
                                });
                    }
                }));
            }
        }

        '''

content = content[:loop_body_start] + new_loop_body + content[loop_body_end:]

with open('backend/src/test/java/com/tracex/RbacMatrixTest.java', 'w', encoding='utf-8') as f:
    f.write(content)
