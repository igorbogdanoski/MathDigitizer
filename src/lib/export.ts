import { saveAs } from 'file-saver';
import { MathTask } from "./schema";
import { Document, Paragraph, TextRun, Packer, HeadingLevel, AlignmentType } from 'docx';

export function exportToJson(tasks: MathTask[], filename: string = "math_tasks.json") {
  const dataStr = JSON.stringify(tasks, null, 2);
  const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
  
  const exportFileDefaultName = filename;
  
  const linkElement = document.createElement("a");
  linkElement.setAttribute("href", dataUri);
  linkElement.setAttribute("download", exportFileDefaultName);
  linkElement.click();
}

export async function exportToWord(tasks: MathTask[], filename: string = "math_materials.docx") {
  const children: any[] = [];
  
  children.push(
    new Paragraph({
      text: "Извлечени Едукативни Материјали",
      heading: HeadingLevel.HEADING_1,
    })
  );

  tasks.forEach((task, index) => {
    children.push(
      new Paragraph({
        text: `${task.type === 'theory' ? 'Теорија' : 'Задача'} ${index + 1}: ${task.title}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Одделение: ", bold: true }),
          new TextRun(task.grade_level || 'Непознато'),
          new TextRun({ text: " | Тежина: ", bold: true }),
          new TextRun(task.difficulty)
        ]
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Текст: ", bold: true })
        ],
        spacing: { before: 200 }
      }),
      new Paragraph({
        text: task.original_text,
        spacing: { after: 200 }
      }),
      new Paragraph({
        text: task.type === 'theory' ? 'Клучни точки:' : 'Чекори за решавање:',
        heading: HeadingLevel.HEADING_3,
      })
    );

    task.solution_steps.forEach((step, stepIndex) => {
      children.push(
        new Paragraph({
          text: `${stepIndex + 1}. ${step}`,
          bullet: {
            level: 0
          }
        })
      );
    });

    if (task.latex_formulas && task.latex_formulas.length > 0) {
      children.push(
        new Paragraph({
          text: "Формули:",
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200 }
        })
      );
      task.latex_formulas.forEach(formula => {
        // Outputting LaTeX string inside docx text nodes as we don't have direct OMML compilation without heavy processing.
        // It provides standard readable math expressions for copy/paste.
        children.push(
          new Paragraph({
            text: formula,
            bullet: { level: 0 }
          })
        );
      });
    }
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: children
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename.endsWith('.docx') ? filename : filename + '.docx');
}

export async function exportLessonPlanToWord(planData: any, filename: string = "lesson-plan.docx") {
  const children: any[] = [];
  
  // Title
  children.push(
    new Paragraph({
      text: "ДНЕВНА ПОДГОТОВКА ЗА ЧАС",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  );

  children.push(
    new Paragraph({ text: `Тема: ${planData.topic}`, heading: HeadingLevel.HEADING_2 }),
    new Paragraph({ text: `Одделение: ${planData.grade}`, spacing: { after: 300 } })
  );

  // Objectives
  children.push(new Paragraph({ text: "Цели на часот:", heading: HeadingLevel.HEADING_3 }));
  planData.objectives.forEach((obj: string) => {
    children.push(new Paragraph({ text: obj, bullet: { level: 0 } }));
  });

  // Outcomes
  children.push(new Paragraph({ text: "Очекувани исходи:", heading: HeadingLevel.HEADING_3, spacing: { before: 200 } }));
  planData.outcomes.forEach((out: string) => {
    children.push(new Paragraph({ text: out, bullet: { level: 0 } }));
  });

  // Flow
  children.push(
    new Paragraph({ text: "Тек на часот", heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 } }),
    
    new Paragraph({ text: "Воведен дел:", heading: HeadingLevel.HEADING_3 }),
    new Paragraph({ text: planData.intro, spacing: { after: 200 } }),
    
    new Paragraph({ text: "Главен дел:", heading: HeadingLevel.HEADING_3 }),
    new Paragraph({ text: planData.main, spacing: { after: 200 } }),
    
    new Paragraph({ text: "Завршен дел:", heading: HeadingLevel.HEADING_3 }),
    new Paragraph({ text: planData.outro, spacing: { after: 300 } })
  );

  // Assessment
  children.push(
    new Paragraph({ text: "Формативно оценување", heading: HeadingLevel.HEADING_2 }),
    new Paragraph({ text: planData.assessment })
  );

  const doc = new Document({
    sections: [{ properties: {}, children }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename.endsWith('.docx') ? filename : filename + '.docx');
}

export function exportToLatex(tasks: MathTask[], filename: string = "math_document.tex") {
  let texContent = `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{geometry}
\\geometry{a4paper, margin=1in}
\\title{Математички Материјали}
\\author{Генерирано од MathDigitizer Pro}
\\begin{document}
\\maketitle

`;

  tasks.forEach((task, index) => {
    texContent += `\\section*{${task.type === 'theory' ? 'Теорија' : 'Задача'} ${index + 1}: ${task.title}}\n`;
    texContent += `\\textbf{Тежина:} ${task.difficulty} \\quad `;
    if (task.grade_level) texContent += `\\textbf{Одделение:} ${task.grade_level}`;
    texContent += `\n\n`;
    
    // Simplistic escaping for standard text but letting math pass requires complex parsing, 
    // we assume original_text has standard $x^2$ formats which LaTeX inherently parses.
    // Replacing newlines with latex newlines
    const formattedText = task.original_text.replace(/\n\n/g, '\\par\n\n');
    texContent += `${formattedText}\n\n`;
    
    texContent += `\\subsection*{${task.type === 'theory' ? 'Клучни точки' : 'Решение'}}\n`;
    texContent += `\\begin{enumerate}\n`;
    task.solution_steps.forEach((step) => {
      texContent += `  \\item ${step.replace(/\n/g, ' ')}\n`;
    });
    texContent += `\\end{enumerate}\n\n`;
  });

  texContent += `\\end{document}`;

  const dataUri = "data:text/plain;charset=utf-8," + encodeURIComponent(texContent);
  const linkElement = document.createElement("a");
  linkElement.setAttribute("href", dataUri);
  linkElement.setAttribute("download", filename);
  linkElement.click();
}

export function exportToTxt(tasks: MathTask[], filename: string = "math_data.txt") {
  let txtContent = "Математички Материјали\n=====================\n\n";
  tasks.forEach((task, index) => {
    txtContent += `${task.type === 'theory' ? 'Теорија' : 'Задача'} ${index + 1}: ${task.title}\n`;
    txtContent += `Тежина: ${task.difficulty}\n`;
    txtContent += `Текст:\n${task.original_text}\n\n`;
    txtContent += `Чекори:\n`;
    task.solution_steps.forEach((s, i) => {
      txtContent += `${i+1}. ${s}\n`;
    });
    txtContent += `---------------------------------------\n\n`;
  });

  const dataUri = "data:text/plain;charset=utf-8," + encodeURIComponent(txtContent);
  const linkElement = document.createElement("a");
  linkElement.setAttribute("href", dataUri);
  linkElement.setAttribute("download", filename);
  linkElement.click();
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
    
    mdContent += `### NanoBanana Prompt (English):\n\`\`\`text\n${task.illustration_prompt}\n\`\`\`\n\n`;
    mdContent += `---\n\n`;
  });

  const dataUri = "data:text/markdown;charset=utf-8," + encodeURIComponent(mdContent);
  
  const linkElement = document.createElement("a");
  linkElement.setAttribute("href", dataUri);
  linkElement.setAttribute("download", filename);
  linkElement.click();
}
