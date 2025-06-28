import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { css } from '@/styled-system/css';

interface ProjectProps {
  project: {
    name: string;
    logo: string;
    url: string;
    description: string;
    categories: string[];
  };
}

export function ProjectCard({ project }: ProjectProps) {
  return (
    <Link 
      href={project.url}
      target="_blank"
      rel="noopener noreferrer"
      className={css({ 
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
      })}
    >
      <div 
        className={css({ 
          px: '10px', 
          py: '8px',
          display: 'flex', 
          alignItems: 'flex-start',
          gap: '5',
          borderRadius: 'xl',
          backgroundColor: 'white',
          backgroundImage: 'linear-gradient(45deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 1) 100%)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          transition: 'all 0.3s ease',
          border: '1px solid rgba(0,0,0,0.05)',
          height: '100%',
          _hover: { 
            transform: 'translateY(-5px)',
            boxShadow: 'md'
          }
        })}
      >
        {/* Logo */}
        <div className={css({ 
          flexShrink: 0,
          height: '64', 
          width: '64', 
          position: 'relative',
        })}>
          <Image
            src={project.logo}
            alt={project.name}
            width={64}
            height={64}
            className={css({ 
              objectFit: 'contain',
              borderRadius: 'md' 
            })}
          />
        </div>
        
        {/* Text content */}
        <div className={css({
          display: 'flex',
          pl: '10px',
          flexDirection: 'column',
          gap: '2'
        })}>
          <h3 className={css({ 
            fontSize: '18px', 
            fontWeight: 'semibold', 
            color: 'text',
            mb: '1'
          })}>
            {project.name}
          </h3>
          <p className={css({
            fontSize: '14px',
            color: 'textMuted',
            lineHeight: 'tight'
          })}>
            {project.description}
          </p>
        </div>
      </div>
    </Link>
  );
} 