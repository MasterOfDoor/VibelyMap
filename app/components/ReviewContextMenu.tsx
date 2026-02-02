"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ReviewContextMenuProps {
  x: number;
  y: number;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ReviewContextMenu({ x, y, onEdit, onDelete, onClose }: ReviewContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 160);
  const adjustedY = Math.min(y, window.innerHeight - 100);

  return createPortal(
    <div
      ref={menuRef}
      className="review-context-menu"
      style={{
        position: "fixed",
        left: adjustedX,
        top: adjustedY,
        zIndex: 10000,
      }}
    >
      <button
        type="button"
        className="context-menu-item"
        onClick={() => {
          onEdit();
          onClose();
        }}
      >
        <span className="context-menu-icon">✏️</span>
        Edit
      </button>
      <button
        type="button"
        className="context-menu-item delete"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        <span className="context-menu-icon">🗑️</span>
        Delete
      </button>
    </div>,
    document.body
  );
}

interface EditReviewModalProps {
  review: {
    id: string;
    rating: number;
    comment: string;
  };
  onSave: (rating: number, comment: string) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

export function EditReviewModal({ review, onSave, onClose, isLoading }: EditReviewModalProps) {
  const [rating, setRating] = useState(review.rating);
  const [comment, setComment] = useState(review.comment);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || isLoading) return;

    setIsSaving(true);
    try {
      await onSave(rating, comment);
      onClose();
    } catch (error) {
      console.error("Failed to save review:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="edit-review-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Review</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="editRating">Rating</label>
              <div className="rating-input">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`star-btn ${star <= rating ? "active" : ""}`}
                    onClick={() => setRating(star)}
                  >
                    {star <= rating ? "★" : "☆"}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="editComment">Comment</label>
              <textarea
                id="editComment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                placeholder="Share your thoughts..."
                required
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="pill secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="pill primary"
              disabled={isSaving || isLoading || !comment.trim()}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
