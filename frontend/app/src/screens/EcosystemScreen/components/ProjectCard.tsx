import React from 'react';
import Image from 'next/image';
import { css } from '@/styled-system/css';

interface ProjectProps {
  project: {
    name: string;
    logo: string;
  };
}

export function ProjectCard({ project }: ProjectProps) {
  return (
    <div 
      className={css({ 
        p: '6', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        borderRadius: 'lg',
        transition: 'all 0.3s ease',
        bg: 'surface',
        boxShadow: 'sm',
        border: '1px solid token(colors.border)',
        _hover: { 
          transform: 'translateY(-5px)',
          boxShadow: 'md'
        }
      })}
    >
      <div className={css({ 
        height: '16', 
        width: '16', 
        position: 'relative', 
        mb: '4' 
      })}>
        <Image
          src={project.logo}
          alt={project.name}
          fill
          className={css({ objectFit: 'contain' })}
        />
      </div>
      <h3 className={css({ 
        fontSize: 'lg', 
        fontWeight: 'medium', 
        textAlign: 'center' 
      })}>
        {project.name}
      </h3>
    </div>
  );
} 