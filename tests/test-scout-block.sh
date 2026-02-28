#!/bin/bash
# Test script for scout-block hook

echo "=== Testing scout-block hook ==="

# Test 1: Allowed command (should pass)
echo ""
echo "Test 1: Allowed command (ls -la)"
echo '{"tool_input":{"command":"ls -la"}}' | node .claude/hooks/scout-block.js
if [ $? -eq 0 ]; then
    echo "✓ PASS: Allowed command executed"
else
    echo "✗ FAIL: Allowed command blocked"
fi

# Test 2: Blocked - node_modules
echo ""
echo "Test 2: Blocked pattern - node_modules"
echo '{"tool_input":{"command":"ls node_modules"}}' | node .claude/hooks/scout-block.js 2>/dev/null
if [ $? -eq 2 ]; then
    echo "✓ PASS: node_modules blocked"
else
    echo "✗ FAIL: node_modules not blocked"
fi

# Test 3: Blocked - .git
echo ""
echo "Test 3: Blocked pattern - .git/"
echo '{"tool_input":{"command":"cd .git/ && ls"}}' | node .claude/hooks/scout-block.js 2>/dev/null
if [ $? -eq 2 ]; then
    echo "✓ PASS: .git/ blocked"
else
    echo "✗ FAIL: .git/ not blocked"
fi

# Test 4: Blocked - __pycache__
echo ""
echo "Test 4: Blocked pattern - __pycache__"
echo '{"tool_input":{"command":"find __pycache__"}}' | node .claude/hooks/scout-block.js 2>/dev/null
if [ $? -eq 2 ]; then
    echo "✓ PASS: __pycache__ blocked"
else
    echo "✗ FAIL: __pycache__ not blocked"
fi

# Test 5: Blocked - dist/
echo ""
echo "Test 5: Blocked pattern - dist/"
echo '{"tool_input":{"command":"cat dist/bundle.js"}}' | node .claude/hooks/scout-block.js 2>/dev/null
if [ $? -eq 2 ]; then
    echo "✓ PASS: dist/ blocked"
else
    echo "✗ FAIL: dist/ not blocked"
fi

# Test 6: Blocked - build/
echo ""
echo "Test 6: Blocked pattern - build/"
echo '{"tool_input":{"command":"rm -rf build/"}}' | node .claude/hooks/scout-block.js 2>/dev/null
if [ $? -eq 2 ]; then
    echo "✓ PASS: build/ blocked"
else
    echo "✗ FAIL: build/ not blocked"
fi

# Test 7: Allowed - .env file (should NOT be blocked)
echo ""
echo "Test 7: Allowed pattern - .env file"
echo '{"tool_input":{"command":"cat .env"}}' | node .claude/hooks/scout-block.js
if [ $? -eq 0 ]; then
    echo "✓ PASS: .env file allowed"
else
    echo "✗ FAIL: .env file blocked"
fi

# Test 8: Invalid JSON (should fail)
echo ""
echo "Test 8: Invalid JSON input"
echo 'invalid json' | node .claude/hooks/scout-block.js 2>/dev/null
if [ $? -eq 2 ]; then
    echo "✓ PASS: Invalid JSON rejected"
else
    echo "✗ FAIL: Invalid JSON accepted"
fi

# Test 9: Empty input (should fail)
echo ""
echo "Test 9: Empty input"
echo '' | node .claude/hooks/scout-block.js 2>/dev/null
if [ $? -eq 2 ]; then
    echo "✓ PASS: Empty input rejected"
else
    echo "✗ FAIL: Empty input accepted"
fi

# Test 10: Missing command field (should fail)
echo ""
echo "Test 10: Missing command field"
echo '{"tool_input":{}}' | node .claude/hooks/scout-block.js 2>/dev/null
if [ $? -eq 2 ]; then
    echo "✓ PASS: Missing command field rejected"
else
    echo "✗ FAIL: Missing command field accepted"
fi

# Test 11: Empty command (should fail)
echo ""
echo "Test 11: Empty command value"
echo '{"tool_input":{"command":""}}' | node .claude/hooks/scout-block.js 2>/dev/null
if [ $? -eq 2 ]; then
    echo "✓ PASS: Empty command rejected"
else
    echo "✗ FAIL: Empty command accepted"
fi

echo ""
echo "=== Test complete ==="
