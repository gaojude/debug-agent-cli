module.exports = (page) => {
  let bugDetails = {};

  return {
    setup: async ({ page }) => {
      console.log('🔍 提取具体的错误代码...\n');
    },

    onAfterEvent: async (event, { page, eventIndex }) => {
      if (event.type === 'click' && event.data.target?.text === 'Register') {
        console.log('📸 正在提取验证函数的具体代码...\n');
        
        await page.waitForTimeout(500);
        
        // 提取具体的验证代码
        const codeExtraction = await page.evaluate(() => {
          const result = {
            validationCode: {},
            errorLine: null,
            usernameCheck: null
          };
          
          // 获取 handleSubmit 函数的代码
          if (window.handleSubmit) {
            const code = window.handleSubmit.toString();
            result.validationCode.handleSubmit = code;
            
            // 提取用户名验证部分
            const lines = code.split('\n');
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              
              // 查找用户名长度检查
              if (line.includes('username') && line.includes('length')) {
                // 获取上下文（前后3行）
                const context = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 4));
                result.usernameCheck = {
                  lineNumber: i + 1,
                  line: line.trim(),
                  context: context.map((l, idx) => ({
                    lineNo: i - 3 + idx + 1,
                    content: l
                  }))
                };
              }
            }
          }
          
          // 获取 showError 函数的代码
          if (window.showError) {
            const code = window.showError.toString();
            result.validationCode.showError = code;
            
            // 找到第75行附近的代码（classList错误位置）
            const lines = code.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes('classList')) {
                result.errorLine = {
                  lineNumber: i + 1,
                  line: lines[i].trim(),
                  context: lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3))
                };
                break;
              }
            }
          }
          
          // 获取实际的验证逻辑
          const username = document.getElementById('username').value;
          result.actualValidation = {
            username: username,
            length: username.length,
            'username.length < 3': username.length < 3,
            'username.length > 3': username.length > 3,
            'username.length < 8': username.length < 8,
            'username.length > 8': username.length > 8
          };
          
          return result;
        });
        
        console.log('='.repeat(60));
        console.log('📝 具体的错误代码分析');
        console.log('='.repeat(60));
        
        if (codeExtraction.usernameCheck) {
          console.log('\n1️⃣ 用户名验证代码（handleSubmit函数）：');
          console.log('----------------------------------------');
          codeExtraction.usernameCheck.context.forEach(item => {
            const marker = item.lineNo === codeExtraction.usernameCheck.lineNumber ? ' <<<< 问题在这里' : '';
            console.log(`  第${item.lineNo}行: ${item.content}${marker}`);
          });
          
          console.log('\n  实际验证结果：');
          console.log(`    用户名: "${codeExtraction.actualValidation.username}"`);
          console.log(`    长度: ${codeExtraction.actualValidation.length} 个字符`);
          console.log(`    username.length < 3: ${codeExtraction.actualValidation['username.length < 3']}`);
          console.log(`    username.length > 3: ${codeExtraction.actualValidation['username.length > 3']}`);
          console.log(`    username.length < 8: ${codeExtraction.actualValidation['username.length < 8']}`);
          console.log(`    username.length > 8: ${codeExtraction.actualValidation['username.length > 8']}`);
        }
        
        if (codeExtraction.errorLine) {
          console.log('\n2️⃣ 错误显示代码（showError函数）：');
          console.log('----------------------------------------');
          console.log('  出错位置附近的代码：');
          codeExtraction.errorLine.context.forEach((line, idx) => {
            const lineNo = codeExtraction.errorLine.lineNumber - 2 + idx;
            const marker = line.includes('classList') ? ' <<<< 这里抛出错误' : '';
            console.log(`  第${lineNo}行: ${line}${marker}`);
          });
        }
        
        // 分析具体问题
        console.log('\n3️⃣ 问题分析：');
        console.log('----------------------------------------');
        
        // 检查验证逻辑
        if (codeExtraction.usernameCheck && codeExtraction.usernameCheck.line) {
          const line = codeExtraction.usernameCheck.line;
          
          if (line.includes('>') && line.includes('8')) {
            console.log('❌ 发现问题：代码检查的是 username.length > 8');
            console.log('   但错误信息说"至少3个字符"');
            console.log('   验证条件和错误信息不匹配！');
            console.log(`   实际：${codeExtraction.actualValidation.length} > 8 = ${codeExtraction.actualValidation['username.length > 8']}`);
          } else if (line.includes('<') && line.includes('8')) {
            console.log('❌ 发现问题：代码检查的是 username.length < 8');
            console.log('   但错误信息说"至少3个字符"');
            console.log('   验证条件写反了！应该是 >= 而不是 <');
            console.log(`   实际：${codeExtraction.actualValidation.length} < 8 = ${codeExtraction.actualValidation['username.length < 8']}`);
          } else if (line.includes('<') && line.includes('3')) {
            console.log('✓ 验证条件看起来正确 (length < 3)');
            console.log(`   实际：${codeExtraction.actualValidation.length} < 3 = ${codeExtraction.actualValidation['username.length < 3']}`);
            console.log('   但用户名"judegao"有7个字符，不应该触发这个错误');
          }
        }
        
        bugDetails = codeExtraction;
      }
    },

    onComplete: async ({ page }) => {
      console.log('\n' + '='.repeat(60));
      console.log('🎯 调试总结');
      console.log('='.repeat(60));
      
      console.log('\n问题根源：');
      console.log('1. 验证逻辑错误：可能是条件写反了或者用错了数字');
      console.log('2. showError函数试图访问不存在的DOM元素的classList属性');
      console.log('\n建议修复方案：');
      console.log('1. 检查handleSubmit中的用户名长度验证条件');
      console.log('2. 在showError函数中添加元素存在性检查');
      
      return bugDetails;
    }
  };
};