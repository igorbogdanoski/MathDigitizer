import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Database } from 'lucide-react';
import { MathTask } from '../../lib/schema';
import { Node, Link } from './types';

interface KnowledgeMapTabProps {
  task: MathTask | undefined;
  tasks: MathTask[];
  selectedTaskId: string | null;
}

export const KnowledgeMapTab: React.FC<KnowledgeMapTabProps> = ({ task, tasks, selectedTaskId }) => {
  const { t } = useTranslation('pedagogue');
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<any>(null);

  useEffect(() => {
    if (task) {
      renderKnowledgeMap();
    }
    return () => {
      simulationRef.current?.stop();
    };
  }, [selectedTaskId]);

  const renderKnowledgeMap = async () => {
    if (!svgRef.current || !task) return;
    const d3 = await import('d3');

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    d3.select(svgRef.current).selectAll("*").remove();

    const nodes: Node[] = [
      { id: task.id as string, title: task.title, type: 'task' },
      ...(task.related_task_ids || []).map(id => {
        const t = tasks.find(task => task.id === id);
        return { id, title: t?.title || 'Related Task', type: 'task' } as Node;
      }),
      ...(task.prerequisite_task_ids || []).map(id => {
        const t = tasks.find(task => task.id === id);
        return { id, title: t?.title || 'Prerequisite', type: 'task' } as Node;
      })
    ];

    const links: Link[] = [
      ...(task.related_task_ids || []).map(id => ({ source: task.id as string, target: id, value: 1 })),
      ...(task.prerequisite_task_ids || []).map(id => ({ source: id, target: task.id as string, value: 2 }))
    ];

    simulationRef.current?.stop();
    const simulation = d3.forceSimulation<Node>(nodes)
      .force("link", d3.forceLink<Node, Link>(links).id(d => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter(width / 2, height / 2));
    simulationRef.current = simulation;

    const svg = d3.select(svgRef.current);

    const link = svg.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#475569")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => Math.sqrt(d.value) * 2)
      .attr("stroke-dasharray", d => d.value === 2 ? "5,5" : "0");

    const node = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(d3.drag<SVGGElement, Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended) as any);

    node.append("circle")
      .attr("r", d => d.id === selectedTaskId ? 12 : 8)
      .attr("fill", d => d.id === selectedTaskId ? "#6366f1" : "#94a3b8")
      .attr("stroke", "#1e293b")
      .attr("stroke-width", 2);

    node.append("text")
      .text(d => d.title)
      .attr("x", 15)
      .attr("y", 5)
      .attr("fill", "#f8fafc")
      .style("font-size", "10px")
      .style("font-family", "JetBrains Mono");

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as any).x)
        .attr("y1", d => (d.source as any).y)
        .attr("x2", d => (d.target as any).x)
        .attr("y2", d => (d.target as any).y);

      node
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
  };

  return (
    <motion.div
      key="map"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="w-full h-full relative"
    >
      <svg ref={svgRef} className="w-full h-full" />
      <div className="absolute bottom-8 left-8 p-4 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl max-w-sm">
        <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2 mb-2">
          <Database className="w-3 h-3 text-indigo-400" />
          {t('knowledgeMap.legend')}
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <span>{t('knowledgeMap.primaryTaskNode')}</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <div className="w-2 h-2 rounded-full bg-slate-400" />
            <span>{t('knowledgeMap.relationshipConnection')}</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <div className="w-6 h-px bg-slate-600 border-dashed border-t" />
            <span>{t('knowledgeMap.prerequisiteDependency')}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
