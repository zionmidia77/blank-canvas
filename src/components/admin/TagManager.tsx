import { useState } from "react";
import { useTags, useClientTags, useToggleClientTag, useCreateTag } from "@/hooks/useSupabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tag, Plus, Check } from "lucide-react";
import { toast } from "sonner";

const TAG_COLORS = [
  "hsl(0 72% 51%)", "hsl(217 91% 60%)", "hsl(142 71% 45%)",
  "hsl(38 92% 50%)", "hsl(262 83% 58%)", "hsl(180 70% 50%)",
  "hsl(330 70% 50%)", "hsl(45 93% 47%)",
];

interface TagManagerProps {
  clientId: string;
  compact?: boolean;
}

const TagManager = ({ clientId, compact = false }: TagManagerProps) => {
  const { data: allTags } = useTags();
  const { data: clientTagAssignments } = useClientTags(clientId);
  const toggleTag = useToggleClientTag();
  const createTag = useCreateTag();
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const assignedTagIds = new Set((clientTagAssignments || []).map((a: any) => a.tag_id));

  const handleToggle = (tagId: string) => {
    const assigned = assignedTagIds.has(tagId);
    toggleTag.mutate({ clientId, tagId, assigned });
  };

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    createTag.mutate(
      { name: newTagName.trim(), color: newTagColor },
      {
        onSuccess: () => {
          setNewTagName("");
          toast.success("Tag criada!");
        },
        onError: () => toast.error("Erro ao criar tag"),
      }
    );
  };

  const assignedTags = (clientTagAssignments || [])
    .map((a: any) => a.client_tags)
    .filter(Boolean);

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {assignedTags.map((tag: any) => (
        <span
          key={tag.id}
          className="text-[9px] px-2 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-80 transition-opacity"
          style={{ backgroundColor: tag.color + "25", color: tag.color }}
          onClick={() => handleToggle(tag.id)}
          title="Clique para remover"
        >
          {tag.name}
        </span>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <button className={`inline-flex items-center gap-0.5 rounded-full border border-dashed border-border/50 hover:border-primary/50 transition-colors ${compact ? 'px-1 py-0.5' : 'px-1.5 py-0.5'}`}>
            <Plus className="w-2.5 h-2.5 text-muted-foreground" />
            {!compact && <span className="text-[9px] text-muted-foreground">tag</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="start">
          <p className="text-xs font-medium mb-2">Tags</p>
          <div className="space-y-1 max-h-40 overflow-y-auto mb-2">
            {(allTags || []).map((tag: any) => {
              const isAssigned = assignedTagIds.has(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => handleToggle(tag.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent/50 transition-colors text-left"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="text-xs flex-1">{tag.name}</span>
                  {isAssigned && <Check className="w-3 h-3 text-primary" />}
                </button>
              );
            })}
          </div>
          <div className="border-t border-border/50 pt-2 space-y-1.5">
            <Input
              placeholder="Nova tag..."
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateTag()}
              className="h-7 text-xs rounded-lg"
            />
            <div className="flex gap-1">
              {TAG_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewTagColor(c)}
                  className={`w-4 h-4 rounded-full transition-transform ${newTagColor === c ? 'scale-125 ring-1 ring-offset-1 ring-offset-background ring-primary' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            {newTagName && (
              <Button size="sm" onClick={handleCreateTag} className="w-full h-7 text-xs rounded-lg">
                Criar "{newTagName}"
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default TagManager;
