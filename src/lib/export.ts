import { MathTask } from "./schema";

export function exportToJson(tasks: MathTask[], filename: string = "math_tasks.json") {
  const dataStr = JSON.stringify(tasks, null, 2);
  const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
  
  const exportFileDefaultName = filename;
  
  const linkElement = document.createElement("a");
  linkElement.setAttribute("href", dataUri);
  linkElement.setAttribute("download", exportFileDefaultName);
  linkElement.click();
}

export function exportToWord(tasks: MathTask[], filename: string = "math_materials.doc") {
  const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML To Doc</title></head><body>";
  const footer = "</body></html>";
  
  let htmlContent = header + "<h1>Извлечени Едукативни Материјали</h1>";
  
  tasks.forEach((task, index) => {
    htmlContent += `<h2>${task.type === 'theory' ? 'Теорија' : 'Задача'} ${index + 1}: ${task.title}</h2>`;
    htmlContent += `<p><strong>Одделение:</strong> ${task.grade_level || 'Непознато'} | <strong>Тежина:</strong> ${task.difficulty}</p>`;
    htmlContent += `<p><strong>Текст:</strong> ${task.original_text}</p>`;
    htmlContent += `<h3>${task.type === 'theory' ? 'Клучни точки' : 'Чекори за решавање'}:</h3><ol>`;
    task.solution_steps.forEach(step => {
      htmlContent += `<li>${step}</li>`;
    });
    htmlContent += `</ol>`;
    if (task.latex_formulas.length > 0) {
      htmlContent += `<h3>Формули:</h3><ul>`;
      task.latex_formulas.forEach(formula => {
        htmlContent += `<li>${formula}</li>`;
      });
      htmlContent += `</ul>`;
    }
    htmlContent += `<hr/>`;
  });
  
  htmlContent += footer;
  
  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword'
  });
  
  const url = URL.createObjectURL(blob);
  const linkElement = document.createElement("a");
  linkElement.href = url;
  linkElement.download = filename;
  document.body.appendChild(linkElement);
  linkElement.click();
  document.body.removeChild(linkElement);
}

export function exportToMarkdown(tasks: MathTask[], filename: string = "math_tasks.md") {
  let mdContent = "# Извлечени Едукативни Материјали\n\n";
  
  tasks.forEach((task, index) => {
    if (task.type === 'theory') {
      mdContent += `## Теорија: ${task.title}\n\n`;
    } else {
      mdContent += `## Задача ${index + 1}: ${task.title}\n\n`;
    }

    mdContent += `**Мета-податоци:**\n`;
    if (task.grade_level) mdContent += `- **Одделение/Година:** ${task.grade_level}\n`;
    if (task.curriculum_topic) mdContent += `- **Тема:** ${task.curriculum_topic}\n`;
    if (task.dok_level) mdContent += `- **DoK Ниво:** ${task.dok_level}\n`;
    mdContent += `- **Тежина:** ${task.difficulty}\n`;
    if (task.tags && task.tags.length > 0) mdContent += `- **Тагови:** ${task.tags.join(', ')}\n`;
    mdContent += `\n`;

    if (task.type === 'theory') {
      mdContent += `**Теоретско објаснување:**\n${task.original_text}\n\n`;
      mdContent += `### Клучни точки:\n`;
    } else {
      mdContent += `**Оригинален текст:**\n${task.original_text}\n\n`;
      mdContent += `### Чекори за решавање:\n`;
    }
    
    task.solution_steps.forEach((step, stepIndex) => {
      mdContent += `${stepIndex + 1}. ${step}\n`;
    });
    mdContent += `\n`;
    
    if (task.latex_formulas.length > 0) {
      mdContent += `### Издвоени Формули:\n`;
      task.latex_formulas.forEach(formula => {
        mdContent += `- $$${formula}$$\n`;
      });
      mdContent += `\n`;
    }
    
    mdContent += `### NanoBanana Prompt (English):\n\`\`\`text\n${task.nanobanana_prompt}\n\`\`\`\n\n`;
    mdContent += `---\n\n`;
  });

  const dataUri = "data:text/markdown;charset=utf-8," + encodeURIComponent(mdContent);
  
  const linkElement = document.createElement("a");
  linkElement.setAttribute("href", dataUri);
  linkElement.setAttribute("download", filename);
  linkElement.click();
}
